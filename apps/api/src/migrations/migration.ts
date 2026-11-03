import type { Connection } from 'mongoose';

export interface Migration {
  id: string;
  up(connection: Connection): Promise<void>;
}
