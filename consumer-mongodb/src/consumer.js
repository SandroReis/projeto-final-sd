const { DateTime } = require('luxon');
const service = require('./service/rabbitmq');
const logger = require('./logger');
const db = require('./models');
const dummyController = require('./controllers/dummyController');
const TIME_IN_SECONDS = 10000;

async function connectToDatabase() {
    db.mongoose
    .connect(db.url, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useFindAndModify: false,
        useCreateIndex: true
    })
    .then(() => {
        console.log("Connected to the database!");
    })
    .catch((err) => {
        console.log("Cannot connect to the database!", err);
        process.exit();
    });
}

const avg = (elements) => {
    return elements.reduce((a, b) => a + b, 0) / elements.length || 0; // NaN => Não há registros (FUROU! Quebra o cast do banco)
}

async function connectToRabbit() {

    let tempMetrics = {
        oxygen: [],
        humidity: [],
        temperature: []
    };

    await service.subscribeQueue(function (messageRaw) {
        const message = JSON.parse(messageRaw);
        switch (message.type) {
            case 'oxygen':
                tempMetrics.oxygen.push(message.oxygen);
                break;
            case 'humidity':
                tempMetrics.humidity.push(message.humidity);
                break;
            case 'temperature':
                tempMetrics.temperature.push(message.temperature);
                break;
        }
    });

    const metrics = {
        oxygen: avg(tempMetrics.oxygen),
        humidity: avg(tempMetrics.humidity),
        temperature: avg(tempMetrics.temperature),
        date: DateTime.local().setLocale('pt-BR').toFormat('dd/MM/yyyy')
    };

    try {
        dummyController.insert(metrics);
        logger.info(`Metrics was save successfuly on database : ${JSON.stringify(metrics)}`);
    } catch (error) {
        logger.error(`Failed to save metrics on database : ${JSON.stringify(metrics)}`);
    }

}

async function handle() {
    setInterval(connectToRabbit, TIME_IN_SECONDS);
}

connectToDatabase();
handle();

