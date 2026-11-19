/**
 * Публичный barrel хуков почтовой корреспонденции.
 * Реализация разнесена на модули запросов, мутаций, типов и общих утилит в `./use-mail/*`,
 * а этот путь сохраняет совместимость импортов `@/shared/hooks/useMail`.
 */

export * from './use-mail/useMailTypes';
export * from './use-mail/useMailQueries';
export * from './use-mail/useMailMutations';
