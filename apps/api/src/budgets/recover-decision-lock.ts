import { Types, type Connection } from 'mongoose';

export async function recoverDecisionLock(
  connection: Connection,
  tenantId: string,
  eventId: string,
  token: string,
): Promise<void> {
  if (
    !Types.ObjectId.isValid(tenantId) ||
    !Types.ObjectId.isValid(eventId) ||
    !Types.ObjectId.isValid(token)
  ) {
    throw new Error('Los identificadores o el token no son válidos.');
  }
  const result = await connection.collection('events').updateOne(
    {
      _id: new Types.ObjectId(eventId),
      tenantId: new Types.ObjectId(tenantId),
      budgetDecisionLock: token,
    },
    { $unset: { budgetDecisionLock: '' } },
  );
  if (result.modifiedCount !== 1)
    throw new Error(
      'El bloqueo no existe o el token cambió; no se modificó el evento.',
    );
}
