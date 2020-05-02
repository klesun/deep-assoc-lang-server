import { SymbolStore } from "intelephense/lib/symbolStore";
import { CompletionItem } from "vscode-languageserver";
import * as lsp from 'vscode-languageserver-types';
import { Token, Phrase, PhraseType, LexerMode } from 'php7parser';

// ts-node, enums
import { TokenType } from 'php7parser';
import Psi, { Opt, IPsi, flattenTokens } from "../helpers/Psi";
import { Type } from "../structures/Type";
import { IApiCtx } from "../contexts/ApiCtx";
import Log from "deep-assoc-lang-server/src/Log";

const getStartOffset = (psi: IPsi): number => {
    return flattenTokens(psi.node)[0].offset;
};

/** exclusive */
const getEndOffset = (psi: IPsi): number => {
    const endToken = flattenTokens(psi.node).slice(-1)[0];
    return endToken.offset + endToken.length;
};

const AssocKeyPvdr = (params: {
    apiCtx: IApiCtx,
    psi: IPsi,
}): CompletionItem[] => {
    const apiCtx = params.apiCtx;

    const getArrExpr = (psi: IPsi) => {
        const leaf = psi.asToken()[0];
        if (!leaf) {
            return [];
        }
        const isQuoted =  leaf.node.tokenType === TokenType.StringLiteral
            || ['\'', '"'].includes(leaf.text())
        if (['[', '[]'].includes(leaf.text().trim())) {
            const position = psi.doc.positionAtOffset(leaf.node.offset - 1);
            return apiCtx.getPsiAt({uri: psi.doc.uri, position})
                .flatMap(arrPsi => {
                    do {
                        const end = getEndOffset(arrPsi);
                        const start = getStartOffset(leaf);
                        if (end > start) {
                            return [];
                        } else if (end === start && arrPsi.asPhrase().length) {
                            return arrPsi;
                        }
                    } while (arrPsi = arrPsi.parent()[0]);
                    return [];
                })
                .map(exprPsi => ({exprPsi, isQuoted}));
        } else if (isQuoted) {
            return psi.parent()
                .flatMap(psi => psi.asPhrase(PhraseType.SubscriptExpression))
                .flatMap(assoc => assoc.nthChild(0))
                .map(exprPsi => ({exprPsi, isQuoted}));
        } else {
            return [];
        }
    };

    const getCompletions = (psi: IPsi): CompletionItem[] => {
        const qualOpt = getArrExpr(psi);
        if (!qualOpt.length) {
            return [];
        }
        const {exprPsi, isQuoted} = qualOpt[0];
        return apiCtx.resolveExpr(exprPsi)
            .flatMap(t => t.kind === 'IRecordArr' ? t.entries : [])
            .map(e => e.keyType)
            .flatMap(kt => kt.kind === 'IStr' ? [kt.content] : [])
            .map((label, i) => ({
                label: isQuoted ? label : '\'' + label + '\'',
                sortText: (i + '').padStart(7, '0'),
                detail: 'deep-assoc FTW',
                kind: lsp.CompletionItemKind.Field,
            }));
    };

    const main = () => {
        return getCompletions(params.psi);
    };

    return main();
};

export default AssocKeyPvdr;