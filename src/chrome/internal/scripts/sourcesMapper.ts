/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { SourceMap } from '../../../sourceMaps/sourceMap';
import { LocationInLoadedSource, LocationInScript, Position } from '../locations/location';
import { ILoadedSource } from '../sources/loadedSource';
import { IResourceIdentifier } from '../sources/resourceIdentifier';
import { IScript } from './script';
import { IValidatedMap } from '../../collections/validatedMap';
import { logger } from 'vscode-debugadapter';
import { MappedTokensInScript, NoMappedTokensInScript, IMappedTokensInScript } from '../locations/mappedTokensInScript';
import { Range } from '../locations/rangeInScript';
import { ScriptToHtmlPositionTranslator } from './scriptToHtmlPositionTranslator';
import { HtmlToScriptPositionTranslator } from './htmlToScriptPositionTranslator';

export interface ISourceToScriptMapper {
    getPositionInScript(positionInSource: LocationInLoadedSource): IMappedTokensInScript;
}

export interface IScriptToSourceMapper {
    getPositionInSource(positionInScript: LocationInScript): LocationInLoadedSource;
}

export interface ISourceMapper extends ISourceToScriptMapper, IScriptToSourceMapper { }

export interface IMappedSourcesMapper extends ISourceMapper {
    readonly sources: IResourceIdentifier[];
}

/** This class maps locations from a script into the sources form which it was compiled, and back. */
export class MappedSourcesMapper implements IMappedSourcesMapper {
    private readonly _rangeInSources: IValidatedMap<IResourceIdentifier, Range>;

    constructor(private readonly _script: IScript, private readonly _sourceMap: SourceMap) {
        this._rangeInSources = this._sourceMap.rangesInSources();
    }

    public getPositionInSource(positionRelativeToHtml: LocationInScript): LocationInLoadedSource {
        const positionRelativeToScript = new HtmlToScriptPositionTranslator().toPositionRelativeToScript(this.whereScriptStartsInHtml(), positionRelativeToHtml);

        return this._sourceMap.authoredPosition(positionRelativeToScript, mappedResult => mappedResult, () => {
                // If we couldn't map it, return the location in the development source
                return new LocationInLoadedSource(positionRelativeToHtml.script.developmentSource, positionRelativeToHtml.position);
            });
    }

    public getPositionInScript(positionInSource: LocationInLoadedSource): IMappedTokensInScript {
        if (!this.canPositionPotentiallyHaveMappings(positionInSource)) {
            // The range of this script in the source doesn't has the position, so there won't be any mapping
            logger.log(`SourceMapper: ${positionInSource} is outside the range of ${this._script} so it doesn't map anywhere`);
            return new NoMappedTokensInScript(this._script);
        }

        const manyPositionsInScripts = this._sourceMap.allGeneratedPositionFor(positionInSource); // All the tokens where positionInSource maps to, relative to the script itself

        // All the lines need to be adjusted by the relative position of the script in the resource (in an .html if the script starts in line 20, the first line is 20 rather than 0)
        const tokenRanges = new ScriptToHtmlPositionTranslator().toManyRangesRelativeToHtml(this.whereScriptStartsInHtml(), manyPositionsInScripts);

        const mappedTokensInScript = new MappedTokensInScript(this._script, tokenRanges);
        logger.log(`SourceMapper: ${positionInSource} mapped to script: ${mappedTokensInScript}`);
        return mappedTokensInScript;
    }

    public get sources(): IResourceIdentifier[] {
        return this._sourceMap.mappedSources;
    }

    public toString(): string {
        return `Mapped sources mapper of ${this._script} into ${this._script.mappedSources}`;
    }

    private canPositionPotentiallyHaveMappings(positionInSource: LocationInLoadedSource): boolean {
        const range = this._rangeInSources.get(positionInSource.source.identifier);
        return Position.isBetween(range.start, positionInSource.position, range.exclusiveEnd);
    }

    /**
     * If the script is an inline script in an .html file, and the inline script starts on line 20:5, then this value will be 20:5
     * If this script is not an inline script, this value will be 0:0
     */
    private whereScriptStartsInHtml() {
        return this._script.rangeInSource.start.position;
    }
}

export class NoMappedSourcesMapper implements IMappedSourcesMapper {
    constructor(private readonly _script: IScript) {

    }

    public getPositionInSource(positionInScript: LocationInScript): LocationInLoadedSource {
        return new LocationInLoadedSource(this._script.developmentSource, positionInScript.position);
    }

    public getPositionInScript(positionInSource: LocationInLoadedSource): IMappedTokensInScript {
        if (positionInSource.resource === this._script.developmentSource || positionInSource.resource === this._script.runtimeSource) {
            return MappedTokensInScript.characterAt(new LocationInScript(this._script, positionInSource.position));
        } else {
            throw new Error(`This source mapper can only map locations from the runtime or development scripts of ${this._script} yet the location provided was ${positionInSource}`);
        }
    }

    public get sources(): IResourceIdentifier[] {
        return [];
    }

    public toString(): string {
        return `No sources mapper of ${this._script}`;
    }
}

export class UnmappedSourceMapper implements ISourceMapper {
    constructor(private readonly _script: IScript, private readonly _source: ILoadedSource) { }

    public getPositionInSource(positionInScript: LocationInScript): LocationInLoadedSource {
        return new LocationInLoadedSource(this._source, positionInScript.position);
    }

    public getPositionInScript(positionInSource: LocationInLoadedSource): IMappedTokensInScript {
        return MappedTokensInScript.characterAt(new LocationInScript(this._script, positionInSource.position));
    }

    public toString(): string {
        return `Unmapped sources mapper of ${this._script}`;
    }
}