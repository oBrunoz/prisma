import {
  Component,
  OnDestroy,
  signal,
  HostListener,
  ViewChild,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LoadingService } from '../../../core/services/loading.service';
import { AuthService } from '../../../core/services/auth.service';
import { LucideLogOut, LucideSearch, LucideSettings, LucideUser, LucideX } from '@lucide/angular';
import { BuscaComponent } from '../busca/busca.component';
import { LogoComponent } from '../logo/logo.component';
import { UserAvatarComponent } from '../user-avatar/user-avatar.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, LucideSearch, LucideX, LucideUser, LucideSettings, LucideLogOut, BuscaComponent, LogoComponent, UserAvatarComponent],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent implements OnDestroy {
  sidebarOpen = signal(false);
  menuContaAberto = signal(false);
  // abaixo de xl a busca fica recolhida no ícone
  buscaAberta = signal(false);

  isScrolled = signal(false);

  @ViewChild('busca') busca?: BuscaComponent;

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    public loading: LoadingService,
    public auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  alternarMenuConta(): void {
    this.menuContaAberto.update((v) => !v);
  }

  fecharMenuConta(): void {
    this.menuContaAberto.set(false);
  }

  @HostListener('document:click', ['$event'])
  aoClicarFora(evento: MouseEvent): void {
    if (!this.menuContaAberto()) return;
    const alvo = evento.target as HTMLElement | null;
    if (!alvo?.closest('[data-menu-conta]')) this.menuContaAberto.set(false);
  }

  sair(): void {
    this.closeSidebar();
    this.fecharMenuConta();
    this.auth
      .sair()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => void this.router.navigateByUrl('/'));
  }

  abrirBusca(): void {
    this.buscaAberta.set(true);
    // renderiza já e foca no mesmo toque: fora do gesto o iOS não abre o teclado
    this.cdr.detectChanges();
    this.busca?.focar();
  }

  fecharBusca(): void {
    this.buscaAberta.set(false);
    this.busca?.limpar();
    this.busca?.fechar();
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.isScrolled.set(window.scrollY > 80);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.sidebarOpen.set(false);
    this.menuContaAberto.set(false);
    this.buscaAberta.set(false);
    this.busca?.fechar();
  }

  /** "/" foca a busca, como em sites de catálogo. */
  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;

    const target = event.target as HTMLElement | null;
    const tag = target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;

    event.preventDefault();
    this.abrirBusca();
  }
}
