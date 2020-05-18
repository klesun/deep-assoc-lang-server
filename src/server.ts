
import {
	createConnection,
	ProposedFeatures,
	InitializeParams,
	CompletionItem,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
	RequestType,
	TextDocumentItem,
} from 'vscode-languageserver';

import { Intelephense, LanguageRange } from 'intelephense';
import Log from './Log';
import AssocGetPvdr from './entry/AssocKeyPvdr';
import ApiCtx from './contexts/ApiCtx';
import ArrCtorKeyPvdr from 'deep-assoc-lang-server/src/entry/ArrCtorKeyPvdr';
import { ParsedDocument } from 'intelephense/lib/parsedDocument';
import { SymbolTable } from 'intelephense/lib/symbolStore';
import { ReferenceReader } from 'intelephense/lib/referenceReader';
import StrValsPvdr from 'deep-assoc-lang-server/src/entry/StrValsPvdr';

type Connection = ReturnType<typeof createConnection>;

const phpLanguageId = 'php';

const addIntelephenseListeners = async (connection: Connection) => {
	await Intelephense.initialise({
		storagePath: '/tmp',
		logWriter: {
			info: connection.console.info,
			warn: connection.console.warn,
			error: connection.console.error
		},
		clearCache: true,
	});

	connection.onDidOpenTextDocument((params) => {
		const length = params.textDocument.text.length;
		const maxLength = 300 * 1024;
		if (length > maxLength) {
			connection.console.warn(`${params.textDocument.uri} not opened -- ${length} over max file size of ${maxLength} chars.`);
			return;
		}
		Intelephense.openDocument(params.textDocument);
	});

	connection.onDidChangeTextDocument((params) => {
		Intelephense.editDocument(params.textDocument, params.contentChanges);
	});

	connection.onDidCloseTextDocument((params) => {
		Intelephense.closeDocument(params.textDocument);
	});

	connection.onShutdown(Intelephense.shutdown);

	const discoverSymbolsRequest = new RequestType<{ textDocument: TextDocumentItem }, number, void, void>('discoverSymbols');
	connection.onRequest(discoverSymbolsRequest, async (params) => {
		if (params.textDocument.text.length > 1024 * 1024) {
			const msg = `${params.textDocument.uri} exceeds max file size.`;
			Log.info(msg);
			connection.console.warn(msg);
			return undefined;
		}
		if (params.textDocument.languageId !== phpLanguageId ||
			Intelephense.getApiTools().documentStore.has(params.textDocument.uri)
		) {
			return undefined;
		}
		// following differs from how intelephense was designed: it intentionally did not keep
		// files that weren't opened directly in the stores, possibly for microoptimisation of RAM

		let parsedDocument = new ParsedDocument(params.textDocument.uri, params.textDocument.text, params.textDocument.version);
		Intelephense.getApiTools().documentStore.add(parsedDocument);
		let symbolTable = SymbolTable.create(parsedDocument);
		Intelephense.getApiTools().symbolStore.add(symbolTable);
		let refTable = ReferenceReader.discoverReferences(parsedDocument, Intelephense.getApiTools().symbolStore);
		Intelephense.getApiTools().refStore.add(refTable);
	});

	const forgetRequest = new RequestType<{ uri: string }, void, void, void>('forget');
	connection.onRequest(forgetRequest, (params) => {
		return Intelephense.forget(params.uri);
	});

	const knownDocumentsRequest = new RequestType<void, { timestamp: number, documents: string[] }, void, void>('knownDocuments');
	connection.onRequest(knownDocumentsRequest, () => {
		return Intelephense.knownDocuments();
	});

	connection.onCompletion(
		(params: TextDocumentPositionParams): CompletionItem[] => {
			const apiTools = Intelephense.getApiTools();
			const apiCtx = ApiCtx({apiTools});
			return apiCtx.getPsiAt({
				uri: params.textDocument.uri,
				position: params.position,
				flush: true,
			}).flatMap(psi => [
				...AssocGetPvdr({apiCtx, psi}),
				...ArrCtorKeyPvdr({apiCtx, psi}),
				...StrValsPvdr({apiCtx, psi}),
			]);
		}
	);
};

const main = () => {
	const connection = createConnection(ProposedFeatures.all);

	connection.onInitialize(async (params: InitializeParams) => {
		await addIntelephenseListeners(connection);

		const capabilities = params.capabilities;
		const hasWorkspaceFolderCapability = !!(
			capabilities.workspace && !!capabilities.workspace.workspaceFolders
		);

		const result: InitializeResult = {
			capabilities: {
				textDocumentSync: TextDocumentSyncKind.Incremental,
				// Tell the client that the server supports code completion
				completionProvider: {
					triggerCharacters: ['\'', '"', '['],
				}
			}
		};
		if (hasWorkspaceFolderCapability) {
			result.capabilities.workspace = {
				workspaceFolders: {
					supported: true
				}
			};
		}
		return result;
	});

	connection.listen();
};

main();

process.addListener('message', Log.info);
process.addListener('multipleResolves', Log.info);
process.addListener(<any>'uncaughtException', Log.info);
process.addListener(<any>'unhandledRejection', Log.info);
process.addListener(<any>'warning', Log.info);