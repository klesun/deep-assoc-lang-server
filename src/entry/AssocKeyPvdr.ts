import { CompletionItem } from "vscode-languageserver";
import { Token, Phrase, PhraseType, LexerMode } from 'php7parser';

// ts-node, enums
import { TokenType } from 'php7parser';
import Psi, { Opt, IPsi, flattenTokens } from "../helpers/Psi";
import { IApiCtx } from "../contexts/ApiCtx";
import { makeArrKeyCompletionItems } from "deep-assoc-lang-server/src/helpers/UiAdapter";

const getStartOffset = (psi: IPsi): number => {
    return flattenTokens(psi.node)[0].offset;
};

/** exclusive */
const getEndOffset = (psi: IPsi): number => {
    const endToken = flattenTokens(psi.node).slice(-1)[0];
    return endToken.offset + endToken.length;
};

/** provides completion options in `$arr['<>']` */
const AssocGetPvdr = (params: {
    apiCtx: IApiCtx, psi: IPsi,
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
            .flatMap(makeArrKeyCompletionItems)
            .map(item => ({...item,
                label: isQuoted || item.label.match(/^\d+$/)
                    ? item.label
                    : '\'' + item.label + '\'',
                }));
    };

    return getCompletions(params.psi);
};

export default AssocGetPvdr;