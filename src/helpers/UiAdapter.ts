import { CompletionItem } from "vscode-languageserver";
import { Type } from "deep-assoc-lang-server/src/structures/Type";
import * as lsp from 'vscode-languageserver-types';

/** @module - provides helper functions for making completion options from resolved type structure */

export const makeArrKeyCompletionItems = (arrt: Type): CompletionItem[] => {
    if (arrt.kind !== 'IRecordArr') {
        return [];
    } else {
        return arrt.entries
            .map(e => e.keyType)
            .flatMap(kt => kt.kind === 'IStr' ? [kt.content] : [])
            .map((label, i) => ({
                label: label,
                sortText: (i + '').padStart(7, '0'),
                detail: 'deep-assoc FTW',
                kind: lsp.CompletionItemKind.Field,
            }))
    };
};