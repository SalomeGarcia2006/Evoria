// Isolated integration-test child: terminated after an uncommitted budget write.
const { NestFactory } = require('@nestjs/core');
const { getModelToken } = require('@nestjs/mongoose');
const { AppModule } = require('../src/app.module');
const { AlertsService } = require('../src/alerts/alerts.service');
const {
  ProviderServiceWorkflow,
} = require('../src/provider-services/provider-service-workflow.service');

(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  app.get(AlertsService).onModuleDestroy();
  const budgets = app.get(getModelToken('EventBudget'));
  const original = budgets.findOneAndUpdate.bind(budgets);
  budgets.findOneAndUpdate = async (...args) => {
    const result = await original(...args);
    if (args[1]?.$inc?.providerSpentCop) {
      process.send({ phase: 'uncommitted' });
      await new Promise(() => {});
    }
    return result;
  };
  process.once('message', ({ id, token }) => {
    void app
      .get(ProviderServiceWorkflow)
      .respond(id, token, 'aceptar')
      .catch(() => {
        process.send({ phase: 'failed' });
        process.exitCode = 1;
      });
  });
  process.send({ phase: 'ready' });
})().catch((error) => {
  process.stderr.write(`${error.name}: ${error.message}\n`);
  process.exit(1);
});
