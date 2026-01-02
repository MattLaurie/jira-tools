import { createLogger, format, transports } from 'winston';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  verbose: 3,
  debug: 4,
};

const logger = createLogger({
  level: 'info',
  levels,
  transports: [
    new transports.Console({
      // Redirect all logs to stderr instead of stdout
      stderrLevels: ['error', 'warn', 'info', 'debug', 'verbose'],
      format: format.combine(
        format.colorize(),
        format.printf(({ level, message }) => `${level}: ${message}`)
      ),
    }),
  ],
});

export default logger;
