'use client';

import { useState } from 'react';
import { Button } from '../ui/Button';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <form className="grid gap-5" onSubmit={handleSubmit}>
      <label className="grid gap-2 text-sm font-semibold" htmlFor="email">
        Correo electrónico
        <input
          className="rounded-lg border border-sky-blue px-3 py-2 font-normal outline-none focus:border-teal"
          id="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold" htmlFor="password">
        Contraseña
        <input
          className="rounded-lg border border-sky-blue px-3 py-2 font-normal outline-none focus:border-teal"
          id="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>
      <Button type="submit">Iniciar sesión</Button>
    </form>
  );
}
