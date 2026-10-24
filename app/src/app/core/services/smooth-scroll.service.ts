import { Injectable, NgZone, inject, DestroyRef } from '@angular/core';
import { Router, NavigationEnd, NavigationStart } from '@angular/router';
import Lenis from 'lenis';
import { NavigationStateService } from './navigation-state.service';

@Injectable({ providedIn: 'root' })
export class SmoothScrollService {
  private zone = inject(NgZone);
  private router = inject(Router);
  private navState = inject(NavigationStateService);
  private destroyRef = inject(DestroyRef);

  private lenis?: Lenis;
  private rafId?: number;

  init(): void {
    if (this.lenis) return;

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    this.lenis = new Lenis({
      duration: 1.1,
      // desaceleração exponencial: rápido no começo, assenta no fim
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.6,
    });

    this.zone.runOutsideAngular(() => {
      const raf = (time: number) => {
        this.lenis?.raf(time);
        this.rafId = requestAnimationFrame(raf);
      };
      this.rafId = requestAnimationFrame(raf);
    });

    // o browser também tenta restaurar sozinho, e brigaria com o Lenis
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

    const sub = this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        // a rota que está saindo ainda é a atual aqui
        this.navState.saveScroll(this.router.url, window.scrollY);
        this.navState.setRestoring(event.navigationTrigger === 'popstate');
      }

      if (event instanceof NavigationEnd) {
        const target = this.navState.isRestoring()
          ? this.navState.readScroll(event.urlAfterRedirects)
          : 0;

        this.restoreTo(target);
      }
    });

    this.destroyRef.onDestroy(() => {
      sub.unsubscribe();
      this.destroy();
    });
  }

  private restoreTo(y: number, timeout = 2000): void {
    if (y <= 0) {
      this.scrollWindowTo(0);
      return;
    }

    const deadline = performance.now() + timeout;
    let lastHeight = -1;
    let stableFrames = 0;
    let cancelled = false;

    const cancel = () => {
      cancelled = true;
    };

    window.addEventListener('wheel', cancel, { passive: true, once: true });
    window.addEventListener('touchstart', cancel, { passive: true, once: true });
    window.addEventListener('keydown', cancel, { once: true });

    const finish = () => {
      window.removeEventListener('wheel', cancel);
      window.removeEventListener('touchstart', cancel);
      window.removeEventListener('keydown', cancel);
    };

    const attempt = () => {
      if (cancelled) {
        finish();
        return;
      }

      const height = document.documentElement.scrollHeight;
      const reachable = height - window.innerHeight >= y - 1;

      if (reachable) this.scrollWindowTo(y);

      if (height === lastHeight) {
        stableFrames++;
      } else {
        stableFrames = 0;
        lastHeight = height;
      }

      if ((reachable && stableFrames >= 5) || performance.now() >= deadline) {
        finish();
        return;
      }

      requestAnimationFrame(attempt);
    };

    this.zone.runOutsideAngular(() => requestAnimationFrame(attempt));
  }

  private scrollWindowTo(y: number): void {
    if (this.lenis) {
      this.lenis.scrollTo(y, { immediate: true });
      return;
    }

    window.scrollTo({ top: y, behavior: 'auto' });
  }

  // trava a página por trás de um overlay (modal)
  stop(): void {
    this.lenis?.stop();
    document.body.style.overflow = 'hidden';
  }

  start(): void {
    this.lenis?.start();
    document.body.style.overflow = '';
  }

  scrollTo(target: string | number | HTMLElement, offset = -80): void {
    if (this.lenis) {
      this.lenis.scrollTo(target, { offset });
      return;
    }

    if (typeof target === 'number') {
      window.scrollTo({ top: target, behavior: 'smooth' });
    } else {
      const el = typeof target === 'string' ? document.querySelector(target) : target;
      el?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  private destroy(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.lenis?.destroy();
    this.lenis = undefined;
  }
}
