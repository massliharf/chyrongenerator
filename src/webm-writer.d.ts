declare module 'webm-writer' {
    export default class WebMWriter {
        constructor(options: any);
        addFrame(canvas: HTMLCanvasElement): void;
        complete(): Promise<Blob>;
    }
}
