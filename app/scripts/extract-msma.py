import json
import re
import sys
from pathlib import Path
import pymupdf

pdf = pymupdf.open(sys.argv[1])
stations = []
aliases = {'Johor': 'Johor', 'Kedah': 'Kedah', 'Kelantan': 'Kelantan', 'Kuala': 'Kuala Lumpur', 'Malacca': 'Melaka', 'Negeri': 'Negeri Sembilan', 'Pahang': 'Pahang', 'Penang': 'Pulau Pinang', 'Perak': 'Perak', 'Perlis': 'Perlis', 'Selangor': 'Selangor', 'Terengganu': 'Terengganu'}
for index in range(55, 59):
    words = pdf[index].get_text('words')
    anchors = sorted((w[1], aliases[w[4]]) for w in words if w[0] < 145 and w[4] in aliases)
    ids = [w for w in words if re.fullmatch(r'\d{7}', w[4]) and w[0] < 230]
    for item in ids:
        row = sorted((w for w in words if w[0] > item[0] + 35 and abs(w[1] - item[1]) < 3), key=lambda w: w[0])
        numbers = [w for w in row if re.fullmatch(r'\d+\.\d+', w[4])]
        if len(numbers) != 4:
            raise ValueError((item, numbers))
        state = [name for y, name in anchors if y <= item[1] + 3][-1]
        name = ' '.join(w[4] for w in row if w[0] < numbers[0][0] - 5).strip()
        if not name:
            raise ValueError(('missing station name', item))
        stations.append(dict(id=item[4], name=name, state=state, page=index+1, **dict(zip(['lambda','kappa','theta','eta'], [float(w[4]) for w in numbers]))))

patterns = {}
durations = [15,30,60,180,360,720,1440,2880,4320]
for index in range(63,68):
    words = pdf[index].get_text('words')
    rows = [w for w in words if w[0] < 130 and w[1] > 130 and re.fullmatch(r'\d{1,2}', w[4]) and 1 <= int(w[4]) <= 24]
    data = {str(d): [] for d in durations}
    for item in rows:
        numbers = sorted((w for w in words if w[0] > 100 and abs(w[1]-item[1]) < 2 and re.fullmatch(r'0\.\d{3}',w[4])), key=lambda w:w[0])
        n = int(item[4])
        start = 0 if n<=3 else 1 if n<=6 else 2 if n<=12 else 6
        if len(numbers) != 9-start:
            raise ValueError((index+1, n, numbers))
        for duration, number in zip(durations[start:],numbers):
            data[str(duration)].append(float(number[4]))
    if any(abs(sum(values)-1)>.15 for values in data.values()):
        raise ValueError(('pattern mass balance',index+1,data))
    patterns[str(index-62)] = data

output = Path(__file__).resolve().parents[1]/'src/data'
output.mkdir(exist_ok=True)
(output/'msma.json').write_text(json.dumps({'source':'https://wplb.water.gov.my/assets/msma-2nd-edition.pdf','edition':'2012','stations':stations,'patterns':patterns},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'stations':len(stations),'states':sorted(set(s['state'] for s in stations)),'regions':len(patterns)}))
