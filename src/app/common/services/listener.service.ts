import {Injectable, OnDestroy} from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ListenerService implements OnDestroy {
  private listeners: {[scopeId: string]: (() => void)[]} = {};

  listenTo(scopeId: string): (() => void)[] {
    if (!this.listeners[scopeId]) {
      this.listeners[scopeId] = [];
    }
    //console.log('👂: ', 'ListenerService.listenTo', scopeId);
    return this.listeners[scopeId];
  }

  destroyListeners(scopeId: string): void {
    if (this.listeners[scopeId]) {
      this.listeners[scopeId].forEach((listener) => listener());
      delete this.listeners[scopeId];
      //console.log('❌: ', 'ListenerService.destroyListeners', scopeId);
    }
  }

  ngOnDestroy(): void {
    Object.keys(this.listeners).forEach((scopeId) => this.destroyListeners(scopeId));
  }
}
