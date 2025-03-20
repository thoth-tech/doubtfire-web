import {Injectable, OnDestroy} from '@angular/core';

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
    return this.listeners[scopeId];
  }

  destroyListeners(scopeId: string): void {
    if (this.listeners[scopeId]) {
      this.listeners[scopeId].forEach((listener) => listener());
      delete this.listeners[scopeId];
    }
  }

  ngOnDestroy(): void {
    Object.keys(this.listeners).forEach((scopeId) => this.destroyListeners(scopeId));
  }
}
