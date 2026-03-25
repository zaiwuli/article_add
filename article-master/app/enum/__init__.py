from enum import unique, Enum


@unique
class DownloadClientEnum(Enum):
    QBITTORRENT = "Downloader.qbittorrent"
    TRANSMISSION = "Downloader.transmission"
    THUNDER = "Downloader.thunder"
    CLOUDDRIVE = "Downloader.clouddrive"