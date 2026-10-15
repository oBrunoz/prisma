import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CampoCodigoComponent } from './campo-codigo.component';

describe('CampoCodigoComponent', () => {
  let fixture: ComponentFixture<CampoCodigoComponent>;
  let campo: CampoCodigoComponent;
  let emitidos: string[];
  let completos: string[];

  beforeEach(() => {
    fixture = TestBed.createComponent(CampoCodigoComponent);
    campo = fixture.componentInstance;
    emitidos = [];
    completos = [];
    // sem devolver o valor pelo [valor]: o campo não pode depender da volta do pai
    campo.valorChange.subscribe((v) => {
      emitidos.push(v);
      fixture.detectChanges();
    });
    campo.completo.subscribe((v) => completos.push(v));
    fixture.detectChanges();
  });

  const casas = () => Array.from(fixture.nativeElement.querySelectorAll('input')) as HTMLInputElement[];

  function digitar(i: number, texto: string): void {
    const casa = casas()[i];
    casa.value = texto;
    casa.dispatchEvent(new Event('input'));
  }

  function teclar(i: number, tecla: string): void {
    casas()[i].dispatchEvent(new KeyboardEvent('keydown', { key: tecla, cancelable: true }));
  }

  it('colar o código inteiro preenche as seis casas e avisa que completou', () => {
    digitar(0, '482 913');
    expect(emitidos.at(-1)).toBe('482913');
    expect(completos).toEqual(['482913']);
    expect(casas().map((c) => c.value).join('')).toBe('482913');
  });

  it('digitar uma casa por vez, sem esperar o pai, monta o código', () => {
    '482913'.split('').forEach((d, i) => digitar(i, d));
    expect(completos).toEqual(['482913']);
  });

  it('ignora o que não é dígito', () => {
    digitar(0, 'a');
    expect(emitidos).toEqual([]);
    expect(casas()[0].value).toBe('');
  });

  it('digitar adiante de uma casa vazia escreve na primeira vazia', () => {
    digitar(0, '4');
    digitar(3, '8');
    expect(emitidos.at(-1)).toBe('48');
  });

  it('apagar numa casa vazia volta e apaga a anterior', () => {
    digitar(0, '482');
    teclar(3, 'Backspace');
    expect(emitidos.at(-1)).toBe('48');
    expect(document.activeElement).toBe(casas()[2]);
  });
});
