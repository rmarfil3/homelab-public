import dayjs from 'dayjs';
import winston from 'winston';

const appendTimestamp = winston.format((info: any, _options: any) => {
  const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
  info.message = `[${timestamp}] ${info.message}`;
  return info;
});

const appendPrefix = (prefix?: string) =>
  winston.format((info: any, _options: any) => {
    if (prefix) {
      info.message = `${prefix}: ${info.message}`;
    }
    return info;
  })();

const createLogger = (prefix?: string) => {
  const logger = winston.createLogger({
    transports: [
      new winston.transports.Console({
        level: 'debug',
        handleExceptions: true,
        format: winston.format.combine(
          appendPrefix(prefix),
          appendTimestamp(),
          winston.format.errors({ stack: true }),
          winston.format.colorize(),
          winston.format.splat(),
          winston.format.simple(),
        ),
      }),
    ],
    exitOnError: false, // do not exit on handled exceptions
  });
  logger.stream = {
    write: function (message, _encoding) {
      // use the 'info' log level so the output will be picked up by both
      // transports (file and console)
      logger.info(message);
    },
  } as any;

  return logger;
};

const logger = createLogger();

export { logger, createLogger };
