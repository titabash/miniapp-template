// Claude Code SDK互換のStreamクラス実装

export class Stream<T> {
  private returned: (() => void) | undefined;
  private queue: T[] = [];
  private readResolve?: (value: IteratorResult<T>) => void;
  private readReject?: (error: any) => void;
  private isDone = false;
  private hasError: any;
  private started = false;

  constructor(returned?: () => void) {
    this.returned = returned;
  }

  [Symbol.asyncIterator]() {
    if (this.started) {
      throw new Error("Stream can only be iterated once");
    }
    this.started = true;
    return this;
  }

  async next(): Promise<IteratorResult<T>> {
    if (this.queue.length > 0) {
      return Promise.resolve({
        done: false,
        value: this.queue.shift()!
      });
    }
    
    if (this.isDone) {
      return Promise.resolve({ done: true, value: undefined });
    }
    
    if (this.hasError) {
      return Promise.reject(this.hasError);
    }
    
    return new Promise<IteratorResult<T>>((resolve, reject) => {
      this.readResolve = resolve;
      this.readReject = reject;
    });
  }

  enqueue(value: T) {
    if (this.readResolve) {
      const resolve = this.readResolve;
      this.readResolve = undefined;
      this.readReject = undefined;
      resolve({ done: false, value });
    } else {
      this.queue.push(value);
    }
  }

  done() {
    this.isDone = true;
    if (this.readResolve) {
      const resolve = this.readResolve;
      this.readResolve = undefined;
      this.readReject = undefined;
      resolve({ done: true, value: undefined });
    }
  }

  error(error: any) {
    this.hasError = error;
    if (this.readReject) {
      const reject = this.readReject;
      this.readResolve = undefined;
      this.readReject = undefined;
      reject(error);
    }
  }

  async return(): Promise<IteratorResult<T>> {
    this.isDone = true;
    if (this.returned) {
      this.returned();
    }
    return Promise.resolve({ done: true, value: undefined });
  }
}