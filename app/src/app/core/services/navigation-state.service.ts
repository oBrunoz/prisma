import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NavigationStateService {
  private readonly scrollByUrl = new Map<string, number>();
  private readonly pagesByUrl = new Map<string, number>();

  // verdadeiro enquanto a navegação atual for voltar/avançar do histórico
  private restoring = false;

  setRestoring(value: boolean): void {
    this.restoring = value;
  }

  isRestoring(): boolean {
    return this.restoring;
  }

  saveScroll(url: string, y: number): void {
    this.scrollByUrl.set(url, y);
  }

  readScroll(url: string): number {
    return this.scrollByUrl.get(url) ?? 0;
  }

  savePages(url: string, pages: number): void {
    this.pagesByUrl.set(url, pages);
  }

  readPages(url: string): number {
    return this.pagesByUrl.get(url) ?? 1;
  }
}
