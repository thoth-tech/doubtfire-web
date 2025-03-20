import {Injectable, OnDestroy} from '@angular/core';

const debug: boolean = true;
@Injectable({
  providedIn: 'root',
})
export class ListenerService implements OnDestroy {
  private listeners: {[scopeId: string]: (() => void)[]} = {};
  private idCounter = 0;

  private generateUniqueId(): string {
    return `listener-${++this.idCounter}`;
  }

  listenTo(scopeOrId?: {$id?: string}): (() => void)[] {
    // Use $id if available, otherwise generate one
    const scopeId = scopeOrId?.$id || this.generateUniqueId();

    if (!this.listeners[scopeId]) {
      this.listeners[scopeId] = [];
    }
    if (debug) {
      console.log('👂: ', 'ListenerService.listenTo', scopeId);
    }
    return this.listeners[scopeId];
  }

  destroyListeners(scopeId: string): void {
    if (this.listeners[scopeId]) {
      this.listeners[scopeId].forEach((listener) => listener());
      delete this.listeners[scopeId];
      if (debug) {
        console.log('❌: ', 'ListenerService.destroyListeners', scopeId);
      }
    }
  }

  ngOnDestroy(): void {
    Object.keys(this.listeners).forEach((scopeId) => this.destroyListeners(scopeId));
  }
}
