import { PeerConnectionDM } from "../dataModels/PeerConnectionModel";
import axios from "axios";
import logger from "../lib/logger";
import Client from 'ssh2-sftp-client';
import SftpService from "./sftpService";
import { GroupService } from "./groupService";
import formdata from 'form-data';

export class RecognitionService{
    static async startRecognitionStream(offerSdp: string, offerType: string, groupId: string, sftpClient: Client): Promise<PeerConnectionDM> {
        // Get the group
        const startedAt = Date.now();
        logger.info(`recognition: start groupId=${groupId}`);
        const group = await GroupService.getById(groupId);
        if(!group) throw new Error("Group not found");
        if(!group.dataset) throw new Error("Group dataset not found");
        logger.info(`recognition: group found dataset=${group.dataset}`);

        const dataset = group.dataset;
        const sftpService = new SftpService(sftpClient);
        logger.info(`recognition: downloading /files/${dataset}`);
        const datasetBuffer: Buffer = await sftpService.download(`/files/${dataset}`, undefined) as Buffer;
        if(!datasetBuffer) throw new Error("Could not download dataset from sftp server");
        logger.info(`recognition: dataset bytes=${datasetBuffer.length} in ${Date.now() - startedAt}ms`);

        // Setting configuration of the request
        let form = new formdata();

        // Adding the sdp to the form
        form.append('sdp', offerSdp);
        form.append('sdp_type', offerType);

        // Adding the dataset to the form
        form.append('dataset', datasetBuffer, { filename: `${groupId}.json` });


        // Setting configuration of the request
        var url = `http://${process.env.FACE_ANALYTICS_SERVER}:${process.env.FACE_ANALYTICS_PORT}/recognizer/stream`;
        logger.info(`recognition: POST ${url} offerType=${offerType} offerSdpChars=${offerSdp?.length ?? 0}`);

        const faservice_response = await axios.post(url, form, {
            headers: form.getHeaders(),
            timeout: 25000,
        });
        logger.info(`recognition: upstream ${faservice_response.status} in ${Date.now() - startedAt}ms keys=${Object.keys(faservice_response.data || {}).join(",")}`);

        const answerSdp = {
            "sdp" : faservice_response.data["sdp"],
            "type" : faservice_response.data["type"]
        };

        return answerSdp;
    }
}