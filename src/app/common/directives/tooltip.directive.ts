import {Directive, Input, ElementRef, HostListener, Renderer2} from '@angular/core';

@Directive({
  selector: '[appTooltip]',
})
export class TooltipDirective {
  @Input('appTooltip') tooltipText: string;
  private tooltipElement: HTMLElement;

  constructor(
    private el: ElementRef,
    private renderer: Renderer2,
  ) {}

  @HostListener('mouseenter') onMouseEnter() {
    this.showTooltip();
  }

  @HostListener('mouseleave') onMouseLeave() {
    this.hideTooltip();
  }

  private showTooltip() {
    if (!this.tooltipText) {
      return;
    }

    this.tooltipElement = this.renderer.createElement('span');
    this.tooltipElement.innerHTML = this.tooltipText; // Render HTML content
    this.renderer.appendChild(document.body, this.tooltipElement);
    this.renderer.addClass(this.tooltipElement, 'tooltip-container');
    this.setPosition();
    this.renderer.addClass(this.tooltipElement, 'show');
  }

  private hideTooltip() {
    if (this.tooltipElement) {
      this.renderer.removeChild(document.body, this.tooltipElement);
      this.tooltipElement = null;
    }
  }

  private setPosition() {
    const hostPos = this.el.nativeElement.getBoundingClientRect();
    const tooltipPos = this.tooltipElement.getBoundingClientRect();
    const scrollPos = window.scrollY || document.documentElement.scrollTop;

    const top = hostPos.bottom + scrollPos + 'px';
    let left = hostPos.left + (hostPos.width - tooltipPos.width) / 2;

    // Adjust if tooltip goes out of viewport
    if (left < 0) {
      left = 0;
    } else if (left + tooltipPos.width > window.innerWidth) {
      left = window.innerWidth - tooltipPos.width;
    }

    this.renderer.setStyle(this.tooltipElement, 'top', top);
    this.renderer.setStyle(this.tooltipElement, 'left', `${left}px`);
  }
}
