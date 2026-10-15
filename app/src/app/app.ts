import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { SmoothScrollService } from './core/services/smooth-scroll.service';
import { SeguidoresNovosService } from './core/services/seguidores-novos.service';
import { StripesBackdropComponent } from './shared/components/stripes-backdrop/stripes-backdrop.component';
import { ToastRollComponent } from './shared/components/toast-roll/toast-roll.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent, StripesBackdropComponent, ToastRollComponent],
  templateUrl: './app.html',
  styles: [
    // bloco de referência para a camada de stripes cobrir a altura do documento
    ':host { position: relative; display: block; }',
  ],
})
export class App implements OnInit {
  title = 'prisma';

  private smoothScroll = inject(SmoothScrollService);
  // criado aqui para começar a observar a sessão desde a abertura do site
  private seguidoresNovos = inject(SeguidoresNovosService);

  ngOnInit(): void {
    this.smoothScroll.init();
  }
}
