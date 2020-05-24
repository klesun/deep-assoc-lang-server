import { ReferenceStore, Reference } from "intelephense/lib/reference";
import * as lsp from 'vscode-languageserver-types';
import { Intelephense } from "intelephense";
import Psi, { Opt, IPsi, opt } from "../helpers/Psi";
import { MemberMergeStrategy } from "intelephense/lib/typeAggregate";
import { ParseTreeTraverser } from "intelephense/lib/parseTreeTraverser";
import DirectTypeResolver from "../resolvers/DirectTypeResolver";
import { Type } from "../structures/Type";
import Log from "deep-assoc-lang-server/src/Log";
import { Phrase } from "php7parser";
import { PhpSymbol } from "intelephense/lib/symbol";

const ApiCtx = ({apiTools}: {
    apiTools: ReturnType<typeof Intelephense.getApiTools>,
}): IApiCtx => {

    const getPsiAt = ({uri, position, flush = false}: {
        uri: string, position: lsp.Position, flush?: boolean,
    }): Opt<IPsi> => {
        const doc = apiTools.documentStore.find(uri);
        const table = apiTools.symbolStore.getSymbolTable(uri);
        const refTable = apiTools.refStore.getReferenceTable(uri);
        if (!doc || !table || !refTable) {
            Log.info('Tried to access file out of stores - ' + uri + ': ' + [doc, table, refTable]);
            return [];
        }
        if (flush) {
            doc.flush();
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

    const declBySym = (sym: PhpSymbol) => opt(
        apiTools.symbolStore.symbolLocation(sym)
    ).flatMap(loc => {
        return getPsiAt({uri: loc.uri, position: loc.range.end});
    });

    const inProgress = new Set();

    let self: IApiCtx;
    return self = {
        getPsiAt: getPsiAt,
        declByFqn: (fqn: string) => apiTools
            .symbolStore.find(fqn.replace(/^\\/, ''))
            .flatMap(declBySym),
        decl: (ref: Reference) => apiTools.symbolStore
            .findSymbolsByReference(ref, MemberMergeStrategy.None)
            .flatMap(declBySym),
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
    declByFqn: (fqn: string) => IPsi[],
    decl: (ref: Reference) => IPsi[],
    // TODO: Psi<Phrase>
    resolveExpr: (exprPsi: IPsi) => Type[],
}