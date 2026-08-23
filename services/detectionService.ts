import { PeerConnectionDM } from '../dataModels/PeerConnectionModel';
import axios from 'axios';
import logger from '../lib/logger';
import formdata from 'form-data';

export class DetectionService{
    static async startDetectionStream(offerSdp: string, offerType: string): Promise<PeerConnectionDM> {
        let form = new formdata();

        // Adding the sdp to the form
        form.append('sdp', offerSdp);
        form.append('sdp_type', offerType);

        // Setting configuration of the request
        var url = `http://${process.env.FACE_ANALYTICS_SERVER}:${process.env.FACE_ANALYTICS_PORT}/detector/stream`;
        const startedAt = Date.now();
        logger.info(`detection: POST ${url} FACE_ANALYTICS_SERVER=${process.env.FACE_ANALYTICS_SERVER} FACE_ANALYTICS_PORT=${process.env.FACE_ANALYTICS_PORT} offerType=${offerType} offerSdpChars=${offerSdp?.length ?? 0}`);

        const faservice_response = await axios.post(url, form, {
            headers: form.getHeaders(),
            timeout: 25000,
        });

        logger.info(`detection: upstream ${faservice_response.status} in ${Date.now() - startedAt}ms keys=${Object.keys(faservice_response.data || {}).join(",")}`);

        const answerSdp = {
            "sdp" : faservice_response.data["sdp"],
            "type" : faservice_response.data["type"]
        };

        return answerSdp;
    }
}