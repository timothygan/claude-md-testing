import Anthropic from '@anthropic-ai/sdk';
import { VirtualFileSystem } from '../utils/virtual-fs';
import { Message, ToolCall, ConversationHistory, CommandExecution } from '../types';

export interface ClaudeClientConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  captureThinking?: boolean;
}

export class ClaudeClient {
  private client: Anthropic;
  private config: Required<ClaudeClientConfig>;
  private virtualFS: VirtualFileSystem;
  private commandHistory: CommandExecution[] = [];

  constructor(config: ClaudeClientConfig) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model || 'claude-3-5-sonnet-20241022',
      temperature: config.temperature ?? 0.0,
      maxTokens: config.maxTokens || 4096,
      captureThinking: config.captureThinking ?? true
    };
    
    this.client = new Anthropic({
      apiKey: this.config.apiKey
    });
    
    this.virtualFS = new VirtualFileSystem();
  }

  async executeWithClaudeFile(
    claudeMdContent: string,
    prompt: string,
    options?: {
      timeout?: number;
      previousMessages?: Message[];
    }
  ): Promise<{
    response: string;
    conversation: ConversationHistory;
    tokensUsed: { input: number; output: number; thinking?: number };
    duration: number;
  }> {
    const startTime = Date.now();
    
    const messages: Anthropic.MessageParam[] = [
      ...(options?.previousMessages?.map(msg => ({
        role: msg.role === 'system' ? 'user' as const : msg.role,
        content: msg.content
      })) || []),
      {
        role: 'user' as const,
        content: prompt
      }
    ];

    const tools: Anthropic.Tool[] = [
      {
        name: 'file_write',
        description: 'Write content to a file',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path' },
            content: { type: 'string', description: 'File content' }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'file_read',
        description: 'Read content from a file',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path' }
          },
          required: ['path']
        }
      },
      {
        name: 'file_edit',
        description: 'Edit a file by replacing content',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path' },
            old_content: { type: 'string', description: 'Content to replace' },
            new_content: { type: 'string', description: 'New content' }
          },
          required: ['path', 'old_content', 'new_content']
        }
      },
      {
        name: 'bash_execute',
        description: 'Execute a bash command',
        input_schema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Command to execute' }
          },
          required: ['command']
        }
      },
      {
        name: 'list_directory',
        description: 'List files in a directory',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Directory path' }
          },
          required: ['path']
        }
      }
    ];

    const conversationMessages: Message[] = [];
    let currentMessages = [...messages];
    let finalResponse = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalThinkingTokens = 0;

    while (true) {
      const response = await this.client.messages.create({
        model: this.config.model,
        system: claudeMdContent,
        messages: currentMessages,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        tools,
        tool_choice: { type: 'auto' }
      });

      totalInputTokens += response.usage?.input_tokens || 0;
      totalOutputTokens += response.usage?.output_tokens || 0;

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.content.filter(c => c.type === 'text').map(c => (c as any).text).join(''),
        toolCalls: [],
        timestamp: Date.now(),
        tokens: {
          input: response.usage?.input_tokens || 0,
          output: response.usage?.output_tokens || 0
        }
      };

      const toolUses = response.content.filter(c => c.type === 'tool_use');
      
      if (toolUses.length === 0) {
        finalResponse = assistantMessage.content;
        conversationMessages.push(assistantMessage);
        break;
      }

      const toolResults: Anthropic.MessageParam[] = [];
      
      for (const toolUse of toolUses) {
        const toolCall = await this.executeToolCall(toolUse as any);
        assistantMessage.toolCalls?.push(toolCall);
        
        toolResults.push({
          role: 'user' as const,
          content: [
            {
              type: 'tool_result' as const,
              tool_use_id: (toolUse as any).id,
              content: JSON.stringify(toolCall.result)
            }
          ]
        });
      }

      conversationMessages.push(assistantMessage);
      currentMessages.push(
        { role: 'assistant' as const, content: response.content },
        ...toolResults
      );
    }

    const duration = Date.now() - startTime;

    return {
      response: finalResponse,
      conversation: {
        messages: conversationMessages,
        totalDurationMs: duration,
        modelConfig: {
          model: this.config.model,
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens
        }
      },
      tokensUsed: {
        input: totalInputTokens,
        output: totalOutputTokens,
        thinking: totalThinkingTokens
      },
      duration
    };
  }

  private async executeToolCall(toolUse: any): Promise<ToolCall> {
    const startTime = Date.now();
    let result: any;
    let error: string | undefined;

    try {
      switch (toolUse.name) {
        case 'file_write':
          result = await this.virtualFS.write(toolUse.input.path, toolUse.input.content);
          break;
        
        case 'file_read':
          const content = await this.virtualFS.read(toolUse.input.path);
          result = content !== null ? { content } : { error: 'File not found' };
          break;
        
        case 'file_edit':
          result = await this.virtualFS.edit(
            toolUse.input.path,
            toolUse.input.old_content,
            toolUse.input.new_content
          );
          break;
        
        case 'bash_execute':
          result = await this.executeVirtualCommand(toolUse.input.command);
          break;
        
        case 'list_directory':
          const files = await this.virtualFS.listDirectory(toolUse.input.path);
          result = { files };
          break;
        
        default:
          result = { error: `Unknown tool: ${toolUse.name}` };
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error';
      result = { error };
    }

    return {
      toolName: toolUse.name,
      parameters: toolUse.input,
      result,
      executionTimeMs: Date.now() - startTime,
      error
    };
  }

  private async executeVirtualCommand(command: string): Promise<any> {
    const execution: CommandExecution = {
      command,
      output: '',
      exitCode: 0,
      timestamp: Date.now(),
      durationMs: Math.random() * 100
    };

    // Simulate common commands
    if (command.startsWith('ls')) {
      const path = command.split(' ')[1] || '/workspace';
      const files = await this.virtualFS.listDirectory(path);
      execution.output = files.join('\n');
    } else if (command.startsWith('cat')) {
      const path = command.split(' ')[1];
      if (path) {
        const content = await this.virtualFS.read(path);
        if (content) {
          execution.output = content;
        } else {
          execution.output = `cat: ${path}: No such file or directory`;
          execution.exitCode = 1;
        }
      }
    } else if (command.startsWith('echo')) {
      execution.output = command.slice(5);
    } else if (command === 'pwd') {
      execution.output = '/workspace';
    } else {
      execution.output = `Command simulated: ${command}`;
    }

    this.commandHistory.push(execution);
    return {
      output: execution.output,
      exitCode: execution.exitCode
    };
  }

  getVirtualFS(): VirtualFileSystem {
    return this.virtualFS;
  }

  getCommandHistory(): CommandExecution[] {
    return [...this.commandHistory];
  }

  reset(): void {
    this.virtualFS.reset();
    this.commandHistory = [];
  }
}