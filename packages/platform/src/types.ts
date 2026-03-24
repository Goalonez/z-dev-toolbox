export interface PlatformBridge {
  copyText(text: string): Promise<void>;
  readText(): Promise<string>;
  saveTextFile(filename: string, content: string): Promise<void>;
}
