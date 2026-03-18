import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/config.module';
import { AppConfigService } from '../../config/config.service';
import { WEB_SEARCH_PROVIDER_TOKEN } from './providers/web-search-provider.token';
import { TavilyProvider } from './providers/tavily.provider';
import { SerperProvider } from './providers/serper.provider';
import { WebResearchService } from './web-research.service';
import { WebResearchTool } from './web-research.tool';

@Module({
  imports: [AppConfigModule],
  providers: [
    TavilyProvider,
    SerperProvider,
    {
      provide: WEB_SEARCH_PROVIDER_TOKEN,
      useFactory: (config: AppConfigService, tavily: TavilyProvider, serper: SerperProvider) => {
        return config.webSearchProvider === 'serper' ? serper : tavily;
      },
      inject: [AppConfigService, TavilyProvider, SerperProvider],
    },
    WebResearchService,
    WebResearchTool,
  ],
  exports: [WebResearchService, WebResearchTool],
})
export class WebResearchModule {}
