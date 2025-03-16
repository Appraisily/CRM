import testHandlersRouter from './routes/test-handlers';

// ... existing code ...

// Always include test handlers but protect them with API key
app.use('/api', testHandlersRouter);

// ... existing code ... 