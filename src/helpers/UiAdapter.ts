import { CompletionItem } from "vscode-languageserver";
import { Type } from "deep-assoc-lang-server/src/structures/Type";
import * as lsp from 'vscode-languageserver-types';
import { flattenTypes } from "deep-assoc-lang-server/src/helpers/Typing";

/** @module - provides helper functions for making completion options from resolved type structure */

export const makeItem = (label: string, i: number) => {
    return {
        label: label,
        sortText: (i + '').padStart(7, '0'),
        detail: 'deep-assoc FTW',
        kind: lsp.CompletionItemKind.Field,
    };
};

export const makeArrKeyCompletionItems = (arrt: Type): CompletionItem[] => {
    if (arrt.kind === 'IRecordArr') {
        return arrt.entries
            .map(e => e.keyType)
            .flatMap(kt => kt.kind === 'IStr' ? [kt.content] : [])
            .map((label, i) => makeItem(label, i));
    } else if (arrt.kind === 'IListArr') {
        const items: CompletionItem[] = [];
        for (let i = 0; i < 5; ++i) {
            items.push(makeItem(i + '', i));
        }
        return items;
    } else if (arrt.kind === 'IMapArr') {
        // for enum-like keys
        return flattenTypes(arrt.keyType)
            .flatMap(kt => kt.kind === 'IStr' ? [kt.content] : [])
            .map((label, i) => makeItem(label, i));
    } else {
        return [];
    }
};

export const removeDupes = (items: CompletionItem[]) => {
    const occurences = new Set<string>();
    return items.filter(item => {
        if (occurences.has(item.label)) {
            return false;
        } else {
            occurences.add(item.label);
            return true;
        }
    });
};