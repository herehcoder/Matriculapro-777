declare module 'optiic' {
  interface OptiicOptions {
    apiKey?: string;
  }

  interface OptiicProcessOptions {
    image: string;
    mode?: 'ocr';
  }

  interface OptiicResult {
    text: string;
    language?: string;
  }

  class Optiic {
    constructor(options?: OptiicOptions);
    process(options: OptiicProcessOptions): Promise<OptiicResult>;
  }

  export = Optiic;
}