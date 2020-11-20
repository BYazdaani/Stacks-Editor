import { baseKeymap } from "prosemirror-commands";
import { history } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { MarkdownSerializer } from "prosemirror-markdown";
import { Node as ProseMirrorNode } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import { Transform } from "prosemirror-transform";
import { EditorView } from "prosemirror-view";
import {
    collapseExternalPlugins,
    combineSchemas,
} from "../shared/external-editor-plugin";
import { CodeBlockHighlightPlugin } from "../shared/highlighting/highlight-plugin";
import { error, log } from "../shared/logger";
import { buildMarkdownParser } from "../shared/markdown-parser";
import {
    defaultImageUploadHandler,
    richTextImageUpload,
} from "../shared/prosemirror-plugins/image-upload";
import {
    editableCheck,
    readonlyPlugin,
} from "../shared/prosemirror-plugins/readonly";
import { CodeStringParser, richTextSchema } from "../shared/schema";
import { deepMerge } from "../shared/utils";
import { CommonViewOptions, defaultParserFeatures, View } from "../shared/view";
import { createMenu } from "./commands";
import { richTextInputRules } from "./inputrules";
import { richTextKeymap, tableKeymap } from "./key-bindings";
import { stackOverflowMarkdownSerializer } from "./markdown-serializer";
import { CodeBlockView } from "./node-views/code-block";
import { HtmlBlock, HtmlBlockContainer } from "./node-views/html-block";
import { ImageView } from "./node-views/image";
import { TagLink } from "./node-views/tag-link";
import { codePasteHandler } from "./plugins/code-paste-handler";
import { linkPreviewPlugin, LinkPreviewProvider } from "./plugins/link-preview";
import { linkTooltipPlugin } from "./plugins/link-tooltip";
import { spoilerToggle } from "./plugins/spoiler-toggle";
import { tables } from "./plugins/tables";

export interface RichTextOptions extends CommonViewOptions {
    /** Array of LinkPreviewProviders to handle specific link preview urls */
    linkPreviewProviders?: LinkPreviewProvider[];
    codeblockOverrideLanguage?: string;
}

/*
 * Implements an WYSIWYG-style editor. Content will be rendered immediately by prosemirror but the in- and output will still be markdown
 */
export class RichTextEditor implements View {
    public editorView: EditorView;

    private options: RichTextOptions;
    private markdownSerializer: MarkdownSerializer;

    constructor(target: Node, content: string, options: RichTextOptions = {}) {
        this.options = deepMerge(RichTextEditor.defaultOptions, options);

        const externalPlugins = collapseExternalPlugins(
            this.options.externalPlugins
        );

        const alteredSchema = combineSchemas(
            richTextSchema,
            externalPlugins?.schema
        );

        const markdownParser = buildMarkdownParser(
            this.options.parserFeatures,
            alteredSchema,
            externalPlugins
        );

        this.markdownSerializer = stackOverflowMarkdownSerializer(
            externalPlugins
        );

        let doc: ProseMirrorNode;

        try {
            doc = markdownParser.parse(content);
        } catch (e) {
            // there was a catastrophic error! Try not to lose the user's doc...
            error(
                "RichTextEditorConstructor markdownParser.parse",
                "Catastrophic parse error!",
                e
            );

            doc = CodeStringParser.fromSchema(alteredSchema).parseCode(content);

            // manually add an h1 warning to the newly parsed doc
            const tr = new Transform(doc).insert(
                0,
                alteredSchema.node(
                    "heading",
                    { level: 1 },
                    alteredSchema.text(
                        "WARNING! There was an error parsing the document"
                    )
                )
            );

            doc = tr.doc;
        }

        this.editorView = new EditorView(
            (node: HTMLElement) => {
                node.classList.add(...this.options.classList);
                target.appendChild(node);
            },
            {
                editable: editableCheck,
                state: EditorState.create({
                    doc: doc,
                    plugins: [
                        history(),
                        tableKeymap,
                        richTextKeymap,
                        keymap(baseKeymap),
                        createMenu(this.options),
                        richTextInputRules,
                        linkPreviewPlugin(this.options.linkPreviewProviders),
                        CodeBlockHighlightPlugin(
                            this.options.codeblockOverrideLanguage
                        ),
                        linkTooltipPlugin,
                        richTextImageUpload(
                            this.options.imageUpload,
                            this.options.pluginParentContainer
                        ),
                        readonlyPlugin(),
                        spoilerToggle,
                        tables,
                        codePasteHandler,
                        ...externalPlugins.plugins,
                    ],
                }),
                nodeViews: {
                    code_block(node) {
                        return new CodeBlockView(node);
                    },
                    image(node, view, getPos) {
                        return new ImageView(node, view, getPos);
                    },
                    tagLink(node) {
                        return new TagLink(node);
                    },
                    html_block: function (node) {
                        return new HtmlBlock(node);
                    },
                    html_block_container: function (node) {
                        return new HtmlBlockContainer(node);
                    },
                    ...externalPlugins.nodeViews,
                },
            }
        );

        log(
            "prosemirror rich-text document",
            this.editorView.state.doc.toJSON().content
        );
    }

    get content(): string {
        return this.markdownSerializer.serialize(this.editorView.state.doc);
    }

    get document(): ProseMirrorNode {
        return this.editorView.state.doc;
    }

    get dom(): Element {
        return this.editorView.dom;
    }

    get readonly(): boolean {
        return !this.editorView.editable;
    }

    static get defaultOptions(): RichTextOptions {
        return {
            parserFeatures: defaultParserFeatures,
            editorHelpLink: null,
            linkPreviewProviders: [],
            codeblockOverrideLanguage: null,
            menuParentContainer: null,
            imageUpload: {
                handler: defaultImageUploadHandler,
            },
            externalPlugins: [],
        };
    }

    focus(): void {
        this.editorView.focus();
    }
    destroy(): void {
        this.editorView.destroy();
    }
}