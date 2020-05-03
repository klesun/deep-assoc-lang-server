import { ReferenceStore, Reference } from "intelephense/lib/reference";
import * as lsp from 'vscode-languageserver-types';
import { Intelephense } from "intelephense";
import Psi, { Opt, IPsi, opt } from "../helpers/Psi";
import { MemberMergeStrategy } from "intelephense/lib/typeAggregate";
import { ParseTreeTraverser } from "intelephense/lib/parseTreeTraverser";
import DirectTypeResolver from "../resolvers/DirectTypeResolver";
import { Type } from "../structures/Type";
import Log from "deep-assoc-lang-server/src/Log";

const ApiCtx = ({apiTools}: {
    apiTools: ReturnType<typeof Intelephense.getApiTools>,
}): IApiCtx => {

    const getPsiAt = ({uri, position, flush = false}: {
        uri: string, position: lsp.Position, flush?: boolean,
    }): Opt<IPsi> => {
        const doc = apiTools.documentStore.find(uri);
        if (!doc) {
            return [];
        }
        if (flush) {
            doc.flush();
        }
        const table = apiTools.symbolStore.getSymbolTable(uri);
        const refTable = apiTools.refStore.getReferenceTable(uri);
        if (!table || !refTable) {
            return [];
        }
        const traverser = new ParseTreeTraverser(doc, table, refTable);
        traverser.position(position);
        if (!traverser.node) {
            return [];
        } else {
            const psi = Psi({traverser, node: traverser.node, doc});
            return [psi];
        }
    };

    const inProgress = new Set();

    let self: IApiCtx;
    return self = {
        getPsiAt: getPsiAt,
        decl: (ref: Reference) => apiTools.symbolStore
            .findSymbolsByReference(ref, MemberMergeStrategy.None)
            .flatMap(sym => opt(apiTools.symbolStore.symbolLocation(sym)))
            .flatMap(loc => getPsiAt({uri: loc.uri, position: loc.range.end})),
        resolveExpr: (exprPsi: IPsi) => {
            if (inProgress.has(exprPsi.node)) {
                return []; // cyclic reference
            } else {
                inProgress.add(exprPsi.node);
                // TODO: update when switched to iterators
                const result = DirectTypeResolver({exprPsi, apiCtx: self});
                inProgress.delete(exprPsi.node);
                return result;
            }
        },
    };
};

export default ApiCtx;

export interface IApiCtx {
    getPsiAt: ({uri, position}: {uri: string, position: lsp.Position, flush?: boolean}) => Opt<IPsi>,
    decl: (ref: Reference) => IPsi[],
    resolveExpr: (exprPsi: IPsi) => Type[],
}