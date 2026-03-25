import argparse

from app.scheduler.sht_section_registry import parse_fids
from app.scheduler.sht_sheduler import sync_sht_by_max_page, sync_sht_by_tid


def main():
    parser = argparse.ArgumentParser(description="Run SHT crawler tasks")
    parser.add_argument(
        "--mode",
        choices=["sync_sht_by_tid", "sync_sht_by_max_page"],
        default="sync_sht_by_tid",
    )
    parser.add_argument(
        "--fids",
        default="",
        help="Comma-separated forum ids, such as 2,36,160",
    )
    parser.add_argument("--start-page", type=int, default=1)
    parser.add_argument("--max-page", type=int, default=100)
    args = parser.parse_args()

    kwargs = {
        "fids": parse_fids(args.fids),
        "start_page": args.start_page,
        "max_page": args.max_page,
    }
    if args.mode == "sync_sht_by_tid":
        sync_sht_by_tid(**kwargs)
        return
    sync_sht_by_max_page(**kwargs)


if __name__ == "__main__":
    main()
