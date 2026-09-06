import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent, startWith } from 'rxjs';

export type Viewport = 'mobile' | 'tablet' | 'desktop';

const TABLET_BREAKPOINT = 768;
const DESKTOP_BREAKPOINT = 1024;

/** Owns responsive layout state shared by the shell, sidebar, and header. */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  private readonly widthSignal = signal<number>(this.currentWidth());
  private readonly sidebarOpenSignal = signal<boolean>(false);
  private readonly sidebarCollapsedSignal = signal<boolean>(false);

  public readonly viewport = computed<Viewport>(() => {
    const width = this.widthSignal();
    if (width < TABLET_BREAKPOINT) {
      return 'mobile';
    }
    return width < DESKTOP_BREAKPOINT ? 'tablet' : 'desktop';
  });

  public readonly isMobile = computed(() => this.viewport() === 'mobile');
  public readonly isDesktop = computed(() => this.viewport() === 'desktop');
  public readonly isSidebarOpen = this.sidebarOpenSignal.asReadonly();
  public readonly isSidebarCollapsed = computed(
    () => this.sidebarCollapsedSignal() && this.isDesktop(),
  );

  constructor() {
    const view = this.document.defaultView;
    if (view) {
      fromEvent(view, 'resize')
        .pipe(startWith(null), takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.widthSignal.set(this.currentWidth()));
    }
  }

  public openSidebar(): void {
    this.sidebarOpenSignal.set(true);
  }

  public closeSidebar(): void {
    this.sidebarOpenSignal.set(false);
  }

  public toggleSidebar(): void {
    if (this.isDesktop()) {
      this.sidebarCollapsedSignal.update((collapsed) => !collapsed);
      return;
    }
    this.sidebarOpenSignal.update((open) => !open);
  }

  private currentWidth(): number {
    return this.document.defaultView?.innerWidth ?? DESKTOP_BREAKPOINT;
  }
}
