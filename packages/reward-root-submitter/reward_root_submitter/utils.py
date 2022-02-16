from cloudpathlib import AnyPath
import re
import pyarrow.parquet as pq
from hexbytes import HexBytes


def get_all_reward_outputs(root: AnyPath):
    for file in root.glob("rewardProgramID=*/paymentCycle=*/results.parquet"):
        reward_program_id = re.search(r"rewardProgramID=([^/]*)", str(file)).group(1)
        payment_cycle = re.search(r"paymentCycle=(\d*)", str(file)).group(1)
        yield {
            "file": file,
            "reward_program_id": reward_program_id,
            "payment_cycle": int(payment_cycle),
        }


def get_root_from_file(file: AnyPath):
    with file.open("rb") as pf:
        payment_file = pq.ParquetFile(pf)
        # Read only a single row and a single column
        try:
            file_start = next(payment_file.iter_batches(batch_size=1, columns=["root"]))
            first_row = file_start.to_pylist()[0]
            return HexBytes(first_row["root"])
        except StopIteration:
            return None
