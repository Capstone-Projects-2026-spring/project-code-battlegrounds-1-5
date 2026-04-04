# write to file with its extension, catching error if langauge is not implemented.
# returns None if langauge is not implemented or the filename written to
import json
import random
import string

from  models import *

class Languages:
    map = {
        "javascript": "js",
        # "python": ".py",
    }

    @classmethod
    def is_supported(cls, language: str) -> bool:
        return language in cls.map

def format_js_args(testCase: TestableCase):
    res = []
    for p in testCase.functionInput:
        # print(p)
        # type: Literal[
        #     "string",
        #     "number",
        #     "boolean", # TODO: boolean needs to be language specific. how is it being sent via json? how must it be represented in JS?
        #     "array_string",
        #     "array_number",
        #     "array_array_string",
        #     "array_array_number"
        # ]
        match p.type:
            case "string":
                res.append(f"\"{p.value}\"")
            case "number":
                res.append(f"{p.value}")
            #TODO: boolean here
            case "array_string":
                res.append(f"[ {', '.join(f'\"{v}\"' for v in json.loads(p.value))} ]")
            case "array_number":
                res.append(f"[ {', '.join(f'{v}' for v in json.loads(p.value))} ]")
            case "array_array_string":
                res.append(f"[ { ', '.join(f'[ {", ".join(f"\"{v}\"" for v in inner)} ]'for inner in json.loads(p.value))} ]")
            case "array_array_number":
                res.append(f"[ { ', '.join(f'[ {", ".join(f"{v}" for v in inner)} ]'for inner in json.loads(p.value))} ]")
    return ', '.join(res)



def write_code_to_file(content: str, language: str, testCase: TestableCase = None):
    try:
        lang_ext = Languages.map[language]
    except KeyError:
        return None
    name = ''.join(random.choices(string.ascii_letters + string.digits, k=16))
    invocation = ""
    if language == 'javascript' and testCase is not None:
        param = (format_js_args(testCase))
        invocation = f"\nconsole.log(solution({param}));"
        # print(content + invocation)
    with open(f"/tmp/{name}.{lang_ext}", "w+") as f:
        f.write(content)
        f.write(invocation)
    return f"/tmp/{name}.{lang_ext}"