import json

class SafeDumper:
    @classmethod
    def add_representer(cls, data_type, representer):
        pass

class Dumper:
    @classmethod
    def add_representer(cls, data_type, representer):
        pass

    def ignore_aliases(self, data):
        return True

def add_representer(data_type, representer, Dumper=None):
    pass

def safe_load(stream):
    return json.loads(stream)

def dump(data, stream=None, **kwargs):
    res = json.dumps(data, indent=2, default=str)
    if stream is not None:
        stream.write(res)
    return res

def safe_dump(data, stream=None, **kwargs):
    return dump(data, stream=stream, **kwargs)
