import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LogoComponent } from '../logo/logo.component';

interface FooterLink {
  label: string;
  route: string;
}

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterModule, LogoComponent],
  templateUrl: './footer.component.html',
})
export class FooterComponent {
  currentYear = new Date().getFullYear();

  navegar: FooterLink[] = [
    { label: 'Home', route: '/' },
    { label: 'Filmes', route: '/movies' },
    { label: 'Séries', route: '/series' },
  ];

  conta: FooterLink[] = [
    { label: 'Entrar', route: '/login' },
    { label: 'Criar conta', route: '/register' },
  ];
}
