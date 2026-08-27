// Comprehensive polyfill for ES2024 Iterator helper methods and global Iterator object
// Completely prevents "ReferenceError: Iterator is not defined" across all browsers and WebView engines
(function initIteratorPolyfill() {
  try {
    const root = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : {};

    // Get the base Iterator prototype from Array / Generator / Iterable
    let iterProto: any = {};
    if (typeof Symbol !== 'undefined' && Symbol.iterator) {
      try {
        const arrIter = [][Symbol.iterator]();
        const genProto = Object.getPrototypeOf(arrIter);
        iterProto = Object.getPrototypeOf(genProto) || genProto || {};
      } catch (e) {
        iterProto = {};
      }
    }

    // Define or augment global Iterator constructor
    let IteratorCtor = (root as any).Iterator;
    if (typeof IteratorCtor === 'undefined') {
      IteratorCtor = function Iterator() {};
      IteratorCtor.prototype = iterProto;
      (root as any).Iterator = IteratorCtor;
    } else if (!IteratorCtor.prototype) {
      IteratorCtor.prototype = iterProto;
    }

    if (typeof window !== 'undefined') (window as any).Iterator = IteratorCtor;
    if (typeof global !== 'undefined') (global as any).Iterator = IteratorCtor;

    const targetProto = IteratorCtor.prototype || iterProto;

    // Polyfill Iterator Helper prototype functions if missing
    if (typeof targetProto.map !== 'function') {
      targetProto.map = function* (mapper: (item: any) => any) {
        for (const item of this) {
          yield mapper(item);
        }
      };
    }

    if (typeof targetProto.filter !== 'function') {
      targetProto.filter = function* (predicate: (item: any) => boolean) {
        for (const item of this) {
          if (predicate(item)) yield item;
        }
      };
    }

    if (typeof targetProto.take !== 'function') {
      targetProto.take = function* (limit: number) {
        let count = 0;
        for (const item of this) {
          if (count++ >= limit) break;
          yield item;
        }
      };
    }

    if (typeof targetProto.drop !== 'function') {
      targetProto.drop = function* (limit: number) {
        let count = 0;
        for (const item of this) {
          if (count++ >= limit) yield item;
        }
      };
    }

    if (typeof targetProto.toArray !== 'function') {
      targetProto.toArray = function () {
        return Array.from(this);
      };
    }

    if (typeof targetProto.every !== 'function') {
      targetProto.every = function (predicate: (item: any) => boolean) {
        for (const item of this) {
          if (!predicate(item)) return false;
        }
        return true;
      };
    }

    if (typeof targetProto.some !== 'function') {
      targetProto.some = function (predicate: (item: any) => boolean) {
        for (const item of this) {
          if (predicate(item)) return true;
        }
        return false;
      };
    }

    if (typeof targetProto.find !== 'function') {
      targetProto.find = function (predicate: (item: any) => boolean) {
        for (const item of this) {
          if (predicate(item)) return item;
        }
        return undefined;
      };
    }

    if (typeof targetProto.forEach !== 'function') {
      targetProto.forEach = function (fn: (item: any) => void) {
        for (const item of this) {
          fn(item);
        }
      };
    }

    if (typeof targetProto.join !== 'function') {
      targetProto.join = function (sep = ',') {
        return Array.from(this).join(sep);
      };
    }

    // Also polyfill Promise.withResolvers if absent in older engines
    if (typeof (Promise as any).withResolvers === 'undefined') {
      (Promise as any).withResolvers = function <T>() {
        let resolve!: (value: T | PromiseLike<T>) => void;
        let reject!: (reason?: any) => void;
        const promise = new Promise<T>((res, rej) => {
          resolve = res;
          reject = rej;
        });
        return { promise, resolve, reject };
      };
    }

    // Polyfill Array.prototype.at if missing
    if (typeof Array.prototype.at !== 'function') {
      Array.prototype.at = function (n: number) {
        n = Math.trunc(n) || 0;
        if (n < 0) n += this.length;
        if (n < 0 || n >= this.length) return undefined;
        return this[n];
      };
    }

    // Polyfill Object.hasOwn if missing
    if (typeof Object.hasOwn !== 'function') {
      Object.hasOwn = function (obj: any, prop: any) {
        return Object.prototype.hasOwnProperty.call(obj, prop);
      };
    }
  } catch (err) {
    console.warn('Iterator and baseline polyfill setup notice:', err);
  }
})();

export {};

