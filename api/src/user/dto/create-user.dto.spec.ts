import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserDto } from './create-user.dto.js';

// validacao pura: cobrir por HTTP gastaria o rate limit de /auth/register
async function errosDe(username: unknown): Promise<string[]> {
  const dto = plainToInstance(CreateUserDto, {
    name: 'Fulano',
    username,
    email: 'fulano@teste.com',
    password: 'senhaforte123',
  });

  const erros = await validate(dto);
  return erros.flatMap((e) => Object.keys(e.constraints ?? {}));
}

describe('CreateUserDto: username', () => {
  it.each(['bruno', 'bruno_123', 'abc', 'a'.repeat(20)])(
    'aceita %s',
    async (valido) => {
      expect(await errosDe(valido)).toEqual([]);
    },
  );

  it.each([
    ['curto demais', 'ab'],
    ['longo demais', 'a'.repeat(21)],
    ['com espaco', 'com espaco'],
    ['com hifen', 'com-hifen'],
    ['com acento', 'acentuacao\u00e7'],
    ['com arroba', '@bruno'],
    ['vazio', ''],
  ])('recusa %s', async (_caso, invalido) => {
    expect(await errosDe(invalido)).not.toEqual([]);
  });

  it('normaliza caixa alta e espacos em volta', () => {
    const dto = plainToInstance(CreateUserDto, {
      name: 'Fulano',
      username: '  BRUNO_Alencar  ',
      email: 'fulano@teste.com',
      password: 'senhaforte123',
    });

    expect(dto.username).toBe('bruno_alencar');
  });

  it('nao aceita username ausente', async () => {
    expect(await errosDe(undefined)).not.toEqual([]);
  });
});
