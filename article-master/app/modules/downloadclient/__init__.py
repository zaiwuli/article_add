import json

from app.enum import DownloadClientEnum
from app.modules.downloadclient.cloudnas.cloudnas import CloudNas
from app.modules.downloadclient.qbittorrent import QBitTorrentClient
from app.modules.downloadclient.thunder import Thunder
from app.modules.downloadclient.transmission import TransmissionClient


class DownloaderManager:
    def __init__(self):
        self.instances = {}

    def init(self, configs: list):
        for config in configs:
            self.instances[config.key] = self._create(config.key, json.loads(str(config.content)))

    def _create(self, name: str, conf: dict):
        if name == DownloadClientEnum.QBITTORRENT.value:
            return QBitTorrentClient(conf)
        if name == DownloadClientEnum.TRANSMISSION.value:
            return TransmissionClient(conf)
        if name == DownloadClientEnum.THUNDER.value:
            return Thunder(conf)
        if name == DownloadClientEnum.CLOUDDRIVE.value:
            return CloudNas(conf)
        return None

    def reload(self, name: str, new_conf: dict):
        self.instances[name] = self._create(name, new_conf)

    def get(self, name: str):
        return self.instances.get(name)

downloadManager = DownloaderManager()
