# Copyright (c) Huawei Technologies Co., Ltd. 2021-2021. All rights reserved.

import os
import json
import sys

from enginering_com_utils.http_util import rest

from interface.designer import OssDesigner
from interface.designer import SiteProjectInfo
from interface.designer import OperateSite
from interface.designer import AnalyzeMgr
from interface.designer import SiteBasicConfig
from interface.designer import SiteNetworkConfig
from interface.designer import StorageConfig
from interface.designer import SiteExport
from interface.designer import SiteImport
from interface.designer import ConnectDiagram
from interface.designer import DevicePannel
from interface.designer import IpPlanning
from interface.designer import ResourceSummary
from interface.designer import PortHome
from interface.static_file_server import StaticFileServer

from enginering_toolkit.secwrapper import set_open_func
from enginering_toolkit import secenv

SEC_OPEN = set_open_func()
BASE_PATH = os.path.dirname(os.path.realpath(__file__))

application_map = {
    "common_util": OssDesigner(),
    "site_project_info": SiteProjectInfo(),
    "operate_site": OperateSite(),
    "analyze_mgr": AnalyzeMgr(),
    "site_basic_config": SiteBasicConfig(),
    "site_network_config": SiteNetworkConfig(),
    "storage_config": StorageConfig(),
    "site_export": SiteExport(),
    "site_import": SiteImport(),
    "connect_diagram": ConnectDiagram(),
    "device_pannel": DevicePannel(),
    "resource_summary": ResourceSummary(),
    "ip_planning": IpPlanning(),
    "port_home": PortHome(),
    "static_file_server": StaticFileServer()
}


def get_process_instance_id():
    proc_instance_id = ""
    for argv in sys.argv:
        if argv.startswith("-DNFW="):
            proc_instance_id = argv[6:]
            break
    return proc_instance_id


def get_service_ip_port(proc_instance_id):
    app_version_file = os.path.realpath(secenv.get_env("APP_CONF_FILE", ""))
    if not app_version_file.startswith("/opt"):
        return "", ""

    with SEC_OPEN(app_version_file) as version_fp:
        app_cfg = json.load(version_fp)
    local_cfg = app_cfg["processes"][proc_instance_id]["local"]
    service_ip = local_cfg["ip"]
    service_port = local_cfg["port"]
    return service_ip, service_port


def main():
    proc_instance_id = get_process_instance_id()
    service_ip, service_port = get_service_ip_port(proc_instance_id)
    print(service_ip, service_port)
    http_server_config = rest.OSSHttpServerConfig(service_ip, service_port, 'default',
                                                  rest.OSSHttpServerOptions(thcount=10))
    print(http_server_config)
    rest.INIT_APPLICATION(proc_instance_id, app_version_file=None,
                          extend_http_server_config_list=[http_server_config])
    print(rest)
    from rest.handler import OSSRequestHandler
    rest.G_APPLICATION.add_handlers(r".*", [(r"/ossdesignwebsite/(.*)", OSSRequestHandler)])

    # HUD_BRIDGE_V3
    try:
        from interface.hud_proxy import HudProxyHandler
        rest.G_APPLICATION.add_handlers(
            r".*", [(r"/rest/ossdesign/v1/designer/hud/(.*)", HudProxyHandler)])
        print("[hud] bridge enabled")
    except Exception as _hud_exc:
        print("[hud] bridge disabled:", _hud_exc)

    for _, application in application_map.items():
        rest.REGISTER_SERVANT(application)
    rest.START_APPLICATION()


if __name__ == '__main__':
    main()
