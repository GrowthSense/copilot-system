import { KnowledgeSourceType } from '../../../common/enums/knowledge-source-type.enum';
import { ParsedDocument } from '../interfaces/knowledge-source.interface';

export interface IDocumentParser {
  readonly supportedType: KnowledgeSourceType;
  parse(rawContent: string, sourceRef?: string): ParsedDocument;
}
