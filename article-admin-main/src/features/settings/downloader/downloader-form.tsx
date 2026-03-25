import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card.tsx'
import { ScrollArea } from '@/components/ui/scroll-area.tsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DOWNLOADER_META } from '@/features/settings/data/downloader-list'
import { CommonDownloader } from '@/features/settings/downloader/common-downloader'
import { Thunder } from '@/features/settings/downloader/thunder'

export function DownloaderForm() {
  const [downloaderId, setDownloaderId] = useState<string>('qbittorrent')

  return (
    <Tabs
      value={downloaderId}
      onValueChange={setDownloaderId}
      className='w-full'
    >
      <ScrollArea
        orientation='horizontal'
        type='hover'
        className='w-full'
      >
        <TabsList>
          {DOWNLOADER_META.map((d) => (
            <TabsTrigger key={d.id} value={d.id}>
              {d.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </ScrollArea>

      {DOWNLOADER_META.map((d) => (
        <TabsContent key={d.id} value={d.id}>
          <Card>
            <CardContent>
              {d.id === 'thunder' ? (
                <Thunder downloaderId={d.id} />
              ) : (
                <CommonDownloader key={d.id} downloaderId={d.id} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  )
}
