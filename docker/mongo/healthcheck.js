// Se ejecuta con credenciales administrativas contra el nodo local.
try {
  const replicaSet = process.env.MONGO_REPLICA_SET || 'evoria-rs';
  const memberHost = process.env.MONGO_REPLICA_HOST || 'mongo:27017';
  const state = db.hello();
  if (state.setName === replicaSet && state.isWritablePrimary) quit(0);
  if (state.isreplicaset && !state.setName) {
    try {
      rs.initiate({ _id: replicaSet, members: [{ _id: 0, host: memberHost }] });
    } catch (error) {
      if (error.code !== 23) throw error; // AlreadyInitialized
    }
  }
} catch (error) {
  print(`MongoDB aún no está listo: ${error.message}`);
}
quit(1);
