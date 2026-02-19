declare module 'webm-writer' {
    export default class WebMWriter {
        constructor(options: { quality?: number; frameRate?: number; transparent?: boolean;[key: string]: unknown });
        addFrame(canvas: HTMLCanvasElement): void;
        complete(): Promise<Blob>;
    }
}
